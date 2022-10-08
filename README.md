## Description
Application returns NFC-e data available on the portal fazenda.rj.gov from the qrcode key contained in the NFC-e. Using the [nestjs microservices](https://docs.nestjs.com/microservices/basics) package and RabbitMQ

## Todo
- refactor QrcodeService

## Docker
```
docker-compose up
```

## Installation

```bash
$ npm install
```

## Running the app

```bash
# development
$ npm run start

# watch mode
$ npm run start:dev

# production mode
$ npm run start:prod
```

## Test

```bash
# unit tests
$ npm run test

# e2e tests
$ npm run test:e2e

# test coverage
$ npm run test:cov
```

## Example msg rabbitmq

```
{
"pattern":"consultar_nfe",
"chave": "33210827420879001159651060000445521000446607",
"user": "welingtoncassis@gmail.com",
"cpf":"13768965722"
}
```