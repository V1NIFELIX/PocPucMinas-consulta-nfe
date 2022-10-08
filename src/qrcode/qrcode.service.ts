import { Logger, Injectable } from '@nestjs/common';
import { InjectContext } from 'nest-puppeteer';
import { BrowserContext } from 'puppeteer';
import * as moment from 'moment';
import { RpcException } from '@nestjs/microservices';
import { NotaFiscal } from '../interfaces/nota-fiscal.interface';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class QrcodeService {
  constructor(
    @InjectContext() private readonly browserContext: BrowserContext,
    private configService: ConfigService,
  ) {}

  private readonly logger = new Logger(QrcodeService.name);

  async crawlConsultaNFCe(chave: string) {
    try {
      const url = `${this.configService.get<string>(
        'URL_CONSULTA_NFCE',
      )}${chave}`;
      const page = await this.browserContext.newPage();

      await page.goto(url, {
        timeout: 60000,
        waitUntil: 'networkidle2',
      });

      await page.waitForSelector('.ui-page', { visible: true, timeout: 0 });

      const error = await page.evaluate(() => {
        const el: HTMLElement = document.querySelector('.avisoErro');
        return el ? el.innerText : undefined;
      });

      if (error) {
        await page.close();
        this.logger.error(error);
        throw new Error(error);
      }

      const razao_social = await page.evaluate(() =>
        Array.from(
          document.getElementsByClassName('txtTopo'),
          (e: HTMLElement) => e.innerText,
        ),
      );

      const cnpj_e_endereco = await page.evaluate(() =>
        Array.from(
          document.getElementsByClassName('text'),
          (e: HTMLElement) => e.innerText,
        ),
      );

      const totalitem = await page.evaluate(() =>
        Array.from(
          document.getElementsByClassName('totalNumb'),
          (e: HTMLElement) => e.innerText,
        ),
      );

      const valores = await page.evaluate(() =>
        Array.from(
          document.getElementsByClassName('linhaShade'),
          (e: HTMLElement) => e.innerText,
        ),
      );

      const chave_nota_fiscal = await page.evaluate(() =>
        Array.from(
          document.getElementsByClassName('chave'),
          (e: HTMLElement) => e.innerText,
        ),
      );

      let data_emissao = await page.evaluate(() => {
        const elemento: HTMLElement = document.querySelector(
          '#infos > div:nth-child(1) > div > ul > li ',
        );
        return elemento.innerText;
      });

      const nm_produtos = await page.evaluate(() =>
        Array.from(
          document.getElementsByClassName('txtTit'),
          (e: HTMLElement) => e.innerText,
        ),
      );

      const cod_produtos = await page.evaluate(() =>
        Array.from(
          document.getElementsByClassName('RCod'),
          (e: HTMLElement) => e.innerText,
        ),
      );

      const qnt_produtos = await page.evaluate(() =>
        Array.from(
          document.getElementsByClassName('Rqtd'),
          (e: HTMLElement) => e.innerText,
        ),
      );

      const unidade_medida_produtos = await page.evaluate(() =>
        Array.from(
          document.getElementsByClassName('RUN'),
          (e: HTMLElement) => e.innerText,
        ),
      );

      const vl_produtos = await page.evaluate(() =>
        Array.from(
          document.getElementsByClassName('RvlUnit'),
          (e: HTMLElement) => e.innerText,
        ),
      );

      data_emissao = await this.isDate(data_emissao);
      const _nm_produtos = await this.pegarNomeProdutos(nm_produtos);
      const _cod_produtos = await this.pegarCodigoProdutos(cod_produtos);
      const _qnt_produtos = await this.pegarQtdProdutos(qnt_produtos);
      const _unidade_medida_produtos = await this.pegarMedidaProdutos(
        unidade_medida_produtos,
      );

      const _vl_produtos = await this.pegarValorProdutos(vl_produtos);
      const produtos = await this.gerarObjetoProduto(
        _nm_produtos,
        _cod_produtos,
        _qnt_produtos,
        _unidade_medida_produtos,
        _vl_produtos,
      );

      const cnpj = cnpj_e_endereco.toString().replace(/\,/g, ' ').split(' ')[1];
      const total_itens = Number(totalitem[0]);
      const valor_total = parseFloat(
        valores[0]
          .toString()
          .replace('Valor a pagar R$:\n', '')
          .toString()
          .replace('.', ''),
      );
      const quantidade_cupons = valor_total / 30;

      await page.close();

      const notaFiscal: NotaFiscal = {
        razao_social: razao_social.toString(),
        dados_empresa: cnpj_e_endereco,
        cnpj: cnpj,
        total_itens: total_itens,
        valor_total: valor_total,
        chave_nota_fiscal: chave_nota_fiscal.toString().replace(/[ ]+/g, ''),
        quantidade_cupons: isNaN(quantidade_cupons) ? 0 : quantidade_cupons | 0,
        data_emissao: data_emissao,
        produtos: produtos,
      };
      this.logger.log('Informações da nota fiscal: ', notaFiscal);
      return notaFiscal;
    } catch (error) {
      this.logger.error(error);
      throw new RpcException(error.message);
    }
  }

  private pegarNomeProdutos(produtos) {
    const indexArr = this.getMultiples(2, produtos.length);
    const getFromIndex = (array, indexes) => {
      return array.filter((element, index) => indexes.includes(index));
    };
    const first = produtos[0];
    produtos = getFromIndex(produtos, indexArr);
    produtos.unshift(first);
    return produtos;
  }

  private pegarCodigoProdutos(produtos) {
    for (let index = 0; index < produtos.length; index++) {
      produtos[index] = produtos[index]
        .split(' (Código: ')[1]
        .replace(' )', '');
    }
    // console.log(produtos)
    return produtos;
  }

  private pegarQtdProdutos(produtos) {
    for (let index = 0; index < produtos.length; index++) {
      produtos[index] = produtos[index].split('Qtde.:')[1];
    }
    // console.log(produtos)
    return produtos;
  }

  private pegarMedidaProdutos(produtos) {
    for (let index = 0; index < produtos.length; index++) {
      produtos[index] = produtos[index].split('UN: ')[1];
    }
    // console.log(produtos)
    return produtos;
  }

  private pegarValorProdutos(produtos) {
    for (let index = 0; index < produtos.length; index++) {
      produtos[index] = produtos[index].split('Vl. Unit.:')[1].trim();
    }
    // console.log(produtos)
    return produtos;
  }

  private gerarObjetoProduto(
    nm_produtos,
    cod_produtos,
    qnt_produtos,
    unidade_medida_produtos,
    vl_produtos,
  ) {
    const produtos = [];
    for (let index = 0; index < nm_produtos.length; index++) {
      produtos.push({
        nm_produto: nm_produtos[index],
        cod_produtos: cod_produtos[index],
        qnt_produtos: qnt_produtos[index],
        unidade_medida_produtos: unidade_medida_produtos[index],
        vl_produtos: vl_produtos[index],
      });
    }
    return produtos;
  }

  private getMultiples(n, lim) {
    return [...multiples(n, lim)];
  }

  private async isDate(d): Promise<string> {
    return await new Promise(async (resolve, reject) => {
      d.split(' ').forEach((element) => {
        if (moment(element, 'DD/MM/YYYY', true).isValid()) {
          resolve(element);
        }
      });
    });
  }
}

function* multiples(n, lim) {
  if (lim < n) return [];
  let i = 1,
    r = 0;
  while ((r = n * i++) < lim) {
    yield r;
  }
}
