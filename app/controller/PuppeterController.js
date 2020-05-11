const config = require('../config/database')

const puppeteer = require('puppeteer');
const { PendingXHR } = require('pending-xhr-puppeteer');
const moment = require('moment');
const mysql = require('mysql');

const con = mysql.createConnection(config);

class PuppeterController {
  async start () {
    try {
      const tableName = `servidores_${moment().format('YYYYMMDD')}_${moment().toDate().getTime()}`
      

      con.connect(function(err) {
        if (err) throw err;
        console.log("Connected!");
        var sql = `CREATE TABLE IF NOT EXISTS ${tableName} (
          rgf int(11) PRIMARY KEY,
          nome VARCHAR(255),
          cargo VARCHAR(255),
          referencia VARCHAR(255),
          regime VARCHAR(255),
          bruto DECIMAL(11,2),
          liquido DECIMAL(11,2),
          desconto DECIMAL(11,2)
        )`;
        con.query(sql, function (err, result) {
          if (err) throw err;
          console.log(`Table ${tableName} created`);
        });
      });

  
    const url = 'http://www.transparencia.pmmc.com.br/funcionalismopublico/salarios?pagina=remuneracao';
    const browser = await puppeteer.launch({ 
        headless: true,
        defaultViewport: null,
    })
    
    const page = await browser.newPage()
    const pendingXHR = new PendingXHR(page);


    await page.goto(url, { waitUntil: ['networkidle2', 'domcontentloaded'] });
    await pendingXHR.waitForAllXhrFinished();

    const dataInicial = moment().format('MMMM Do YYYY, h:mm:ss a')
    console.log(dataInicial)
    const qtdServidores = await page.evaluate(() => {
        return $('#tbFuncionarios_info')
                .text()
                .substr(12)
                .replace(',', '')
                .replace('registros', '')
                .trim();
    },{});

    await page.evaluate(({ qtdServidores }) => {
         return $('select[name="tbFuncionarios_length"]').append(`<option value="${qtdServidores}">${qtdServidores}</option>`); 
     },{ qtdServidores });

    await page.select('select[name="tbFuncionarios_length"]', qtdServidores)

    const servidores = await page.evaluate(() => {
        const servidores = [];
        $('#tbFuncionarios > tbody  > tr').each((indexTr, tr) => {
            const servidor = {
                rgf: '',
            }

            $(tr).find('td').each(async (indexTd, td) => {
              if (indexTd + 1 !== $(tr).find('td').size()) return;
              
              servidor.rgf = Number($(td)
                              .find('a')
                              .attr('href')
                              .trim())
            });
            servidores.push(servidor);
         });

         return servidores
    })

    const infos = [];
    for (const [index, servidor] of servidores.entries()) {

       await page.$eval(`a[href="${servidor.rgf}"]`, form => form.click());
       await pendingXHR.waitForAllXhrFinished();
       
       const info = await page.evaluate(() => {
        const info = {
          nome: '',
          cargo: '',
          referencia: '',
          regime: '',
          bruto: '',
          liquido: '',
          desconto: '',
          renumeracao: [],
          descontos: [],
          outrosDescontos: [],
        };
        
          info.nome = $('#nome').text().trim();
          info.cargo = $('#cargo').text().trim();
          info.referencia = $('#referencia').text().trim();
          info.regime = $('#regime').text().trim();
          info.bruto = Number($('#bruto').text().replace('.', '').replace(',', '.'));
          info.liquido = Number($('#liquido').text().replace('.', '').replace(',', '.'));
          info.desconto = Number($('#descontos').text().replace('.', '').replace(',', '.'));

          $('#tbRemuneracao > tr').each((indexTr, tr) => {
            info.renumeracao.push({
              nome: $(tr).find('td').eq(0).text().trim(),
              value:  Number($(tr).find('td').eq(1).text().trim().replace('.', '').replace(',', '.'))
            })
          });

          $('#tbDescontos > tr').each((indexTr, tr) => {
            info.descontos.push({
              nome: $(tr).find('td').eq(0).text().trim(),
              value: Number($(tr).find('td').eq(1).text().trim().replace('.', '').replace(',', '.'))
            })
          });

          $('.table.table-condensed.table-striped > tbody > tr').each((indexTr, tr) => {
            info.outrosDescontos.push({
              nome: $(tr).find('td').eq(0).text().trim(),
             value:  Number($(tr).find('td').eq(1).text().trim().replace('.', '').replace(',', '.'))
            })
          });

          info.outrosDescontos.splice(0, info.descontos.length + info.renumeracao.length)


          return info;
       });

       var sql = `INSERT INTO ${tableName} (rgf, nome, cargo, referencia, regime, bruto, liquido, desconto) VALUES (
        '${servidor.rgf}', '${info.nome}', '${info.cargo}', '${info.referencia}', '${info.regime}', ${info.bruto}, ${info.liquido}, ${info.desconto})`;

       con.query(sql, function (err, result) {
            if (err) throw err;
            // console.log("Row created");
        });
        

       infos.push(info)
       await page.$eval(`button[class="close"]`, form => form.click());
    }
    
    const dataFinal = moment().format('MMMM Do YYYY, h:mm:ss a')
    console.log(dataFinal)

    await page.evaluate(({ infos }) => {
      console.log(infos);
    }, { infos });


    } catch (err) {
      console.log(err)
    }
  }
}

module.exports = new PuppeterController()
