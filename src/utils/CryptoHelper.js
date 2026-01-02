import argon2 from 'argon2';
import os from 'os';

const cpuCores = os.cpus().length;

export async function hashPassword(password) {
  return await argon2.hash(password, {
    type: argon2.argon2id,
    memoryCost: 2048,
    timeCost: 3,
    parallelism: Math.min(4, cpuCores),
    hashLength: 32
  });
}

export async function verifyPassword(password, hash) {
  return await argon2.verify(hash, password);
}

export default {
  hashPassword,
  verifyPassword
};
