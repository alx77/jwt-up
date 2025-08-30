
#!/bin/bash
#ssh-keygen -t ecdsa -b 256 -m PEM -f ECDSA.priv.key
openssl ecparam -name prime256v1 -genkey -noout -out ES256.priv.key
openssl ec -in ES256.priv.key -pubout -out ES256.pub.key
#cat ES256.priv.key ES256.pub.key > jwt-ec.key
