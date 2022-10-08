import { Controller, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Ctx, EventPattern, Payload, RmqContext } from '@nestjs/microservices';
import { ConsultaNFeQRCode } from '../interfaces/consulta-nfe-qrcode.interface';
import { QrcodeService } from './qrcode.service';

@Controller('qrcode')
export class QrcodeController {
  private readonly logger = new Logger(QrcodeController.name);

  constructor(
    private readonly qrcodeService: QrcodeService,
    private configService: ConfigService,
  ) { }

  @EventPattern('consultar_nfe')
  async consultarRankings(
    @Payload() mensagem: ConsultaNFeQRCode,
    @Ctx() context: RmqContext,
  ) {
    const channel = context.getChannelRef();
    const originalMsg = context.getMessage();

    try {
      mensagem = JSON.parse(originalMsg.content.toString());

      this.logger.log('Mensagem recebida: ', mensagem);

      const infosNotaFiscal = await this.qrcodeService.crawlConsultaNFCe(
        mensagem.chave,
      );

      const payloadGerarCupom = {
        pattern: 'gerar_cupom',
        user: mensagem.user,
        cpf: mensagem.cpf,
        notaFiscal: infosNotaFiscal,
      };

      this.logger.log(
        'Enviando notificando a fila GERAR_CUPOM com as informações fiscais',
      );

      this.logger.log('Payload: ', payloadGerarCupom);

      await channel.sendToQueue(
        this.configService.get<string>('RABBITMQ_PRODUCER_QUEUE_NAME'),
        Buffer.from(JSON.stringify(payloadGerarCupom)),
      );

      this.logger.log('Notificação realizada com sucesso!');

      await channel.ack(originalMsg);
    } catch (error) {
      this.logger.error(
        '**** ERROR AO CONSULTAR NOTA FISCAL PELO QRCODE: ',
        error,
      );

      const payloadDeadQueueError = {
        pattern: 'error_consultar_nfe',
        user: mensagem.user,
        cpf: mensagem.cpf,
        chave: mensagem.chave,
        ...error,
      };

      if (
        payloadDeadQueueError.error.includes('Execution') ||
        payloadDeadQueueError.error.includes('destroyed') ||
        payloadDeadQueueError.message.includes('Execution') ||
        payloadDeadQueueError.message.includes('destroyed')
      ) {
        await channel.sendToQueue(
          'EXECUTION_DESTROYED',
          Buffer.from(JSON.stringify(payloadDeadQueueError)),
        );
        await channel.ack(originalMsg);
        return;
      }

      if (
        payloadDeadQueueError.error.includes('tente novamente') ||
        payloadDeadQueueError.error.includes('recuperar') ||
        payloadDeadQueueError.message.includes('tente novamente') ||
        payloadDeadQueueError.message.includes('recuperar')
      ) {
        await channel.sendToQueue(
          'NAO_POSSIVEL_RECUPERAR_NFC',
          Buffer.from(JSON.stringify(payloadDeadQueueError)),
        );
        await channel.ack(originalMsg);
        return;
      }

      await channel.sendToQueue(
        'DEAD_CONSULTAR_NFE_QRCODE',
        Buffer.from(JSON.stringify(payloadDeadQueueError)),
      );

      await channel.ack(originalMsg);
    }
  }
}
