# jwt-up
**jwt-up** is a simple jwt-based auth server written in JS. It uses Postgres to store users, Redis to store activation codes and SMTP to send activation email. It uses `uuid2base64` custom convertion for `user_id`. Also it provides `jwk` for signature verification.
Feel free to replace any parts on your purpose.

## How-to run:
#### Generating EC keys
```
openssl ecparam -name prime256v1 -genkey -noout -out ES256.priv.key
openssl ec -in ES256.priv.key -pubout -out ES256.pub.key
```
or just run script instead
```
./dev/genES256.sh
```
#### Running dockers
```
docker compose -f ./dev/docker-compose.redis.yml \
-f ./dev/docker-compose.postgres.yml \
-f ./dev/docker-compose.mailpit.yml up --detach
```
#### Running jwt-up
```
npm i
npm start
```
### Development
#### Play with swagger
When installation succeed you can use swagger to check the API
[http://localhost:8088/swagger/](http://localhost:8088/swagger/)
### Check DB
Explore Postgres DB with DBeaver on port 25432. 
### Check Redis
To explore Redis use `another-redis-desktop-manager` or even easier with `nc`.
```
> nc localhost 6379
KEYS *
*2
$26
act_P3qe//wjS0W+ZGNYkTBCYg
$26
act_AF2qcU79QFCzBKlElzfr4A

GET act_AF2qcU79QFCzBKlElzfr4A
$36
2db5cf04-b246-4041-86a8-b9967847997c
```
### Check email
You can check activation emails after user registration with **MailPit**
[http://localhost:8025/](http://localhost:8025/)

## Further plans
- implement RBAC endpoints (not implemented now)
- add logout (implement forbidden tokens in Redis with TTL)
- add more activation transports (Kafka, SNS?)
- tests!
- add OTP (requires better integration with frontend, as well as activation, may be makes sense to use url templates with handlebars?)?
- convert it to TS?

## License
[MIT](https://opensource.org/licenses/MIT)
No warranties, use it at your own risk.
Copyright (c) 2025, Alex Furmanov