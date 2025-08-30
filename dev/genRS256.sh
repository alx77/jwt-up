#!/bin/bash
ssh-keygen -t rsa -b 4096 -m PEM -f RS256.priv.key
openssl rsa -in RS256.priv.key -pubout -outform PEM -out RS256.pub.key
#cat RS256.priv.key RS256.pub.key > jwt.key
