export interface NotaFiscal {
  razao_social: string;
  dados_empresa: string[];
  cnpj: string;
  total_itens: number;
  valor_total: number;
  chave_nota_fiscal: string;
  quantidade_cupons: number;
  data_emissao: string;
  produtos: any[];
}
