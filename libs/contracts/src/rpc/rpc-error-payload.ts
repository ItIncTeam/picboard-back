/**
 * Каноническая форма ошибки, которая ходит через RPC-границу (TCP/RMQ).
 *
 * Почему отдельный тип: NestJS пропускает на клиент как есть **только**
 * `RpcException.getError()`, а любой другой класс (`HttpException` и т.п.)
 * дефолтный `BaseRpcExceptionFilter` превращает в
 * `{ status: 'error', message: 'Internal server error' }` — теряя `statusCode`,
 * `message` и `errors`. Поэтому обе стороны обязаны работать с одним контрактом:
 * сервер упаковывает payload в `RpcException({...})`, клиент читает те же поля.
 *
 * @see createRpcValidationPipe, PrismaExceptionFilter — формируют payload
 * @see mapRpcErrorToHttpException — читает payload на клиенте
 */
export type RpcErrorField = {
  field: string;
  message: string;
};

export type RpcErrorPayload = {
  statusCode: number;
  message: string;
  errors?: RpcErrorField[] | null;
};
