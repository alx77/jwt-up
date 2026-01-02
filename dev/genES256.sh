
#!/bin/bash
openssl ecparam -name prime256v1 -genkey -noout -out ES256.priv.key
openssl ec -in ES256.priv.key -pubout -out ES256.pub.key

openssl ecparam -name prime256v1 -genkey -noout -out ES256-service.priv.key
openssl ec -in ES256-service.priv.key -pubout -out ES256-service.pub.key