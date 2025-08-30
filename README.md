# jwt-up
**jwt-up** is a simple jwt-based auth server written in JS. It uses Postgres to store users, Redis to store activation codes and Kafka (temporaly deactivated) to send activation requests to email service. It uses `uuid2base64` custom convertion for `user_id`. Also it provides `jwk` for signature verification. Explore Postgres DB with DBeaver on port 25432. All pipeline/deployment related files are invalid, don't pay attention.
Feel free to replace any parts on your purpose.

## How-to run:
#### Generating keys
```
ssh-keygen -t rsa -b 4096 -m PEM -f RS256.priv.key
openssl rsa -in RS256.priv.key -pubout -outform PEM -out RS256.pub.key
```
or just run script instead
```
./dev/genES256.sh
```
#### Running dockers
```
docker compose -f ./dev/docker-compose.redis.yml up --detach
docker compose -f ./dev/docker-compose.postgres.yml up --detach
```
#### Running jwt-up
```
npm i
npm start
```
## Play with swagger
When installation succeed you can use swagger to check the API
[http://localhost:8088/swagger/](http://localhost:8088/swagger/)

## Further plans
- implement RBAC endpoints
- add couple of activation methods (Kafka, SMTP, SNS?)
- tests!
- add OTP?
- convert it to TS?

## License
[MIT](https://opensource.org/licenses/MIT)

Copyright (c) 2025, Alex Furmanov