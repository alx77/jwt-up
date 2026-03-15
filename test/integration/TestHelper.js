import { pg } from "@/utils/KnexHelper.js";
import redis from "@/utils/RedisHelper.js";
import jwtHelper from "@/utils/JwtHelper.js";
import { encode } from "@/utils/UuidBase64.js";
import { hashPassword } from "@/utils/CryptoHelper.js";
import cfg from "@/common/config.js";
import { AccountStatus, AccountRole } from "@/services/users/index.js";

const ACTIVATION_CODE_PREFIX = "act_";
export async function addUser(user) {
  const encodedPassword = await hashPassword(user.password);

  const userData = await pg.raw(
    "insert into account (login, passwd, email, name, start_date, status) values (?, ?, ?, ?, ?, ?) returning id, uid",
    [
      user.login,
      encodedPassword,
      user.email,
      user.name,
      new Date(),
      user.status ?? AccountStatus.BLOCKED,
    ]
  );
  const userUuid = userData?.rows[0]?.uid;
  const account_id = userData?.rows[0]?.id;
  if (user.roles && user.roles.length > 0 && account_id) {
    for (const role of user.roles) {
      await pg.raw("insert into account_roles (account_id, role_id) values (?, ?)", [
        account_id,
        role,
      ]);
    }
  }

  const activationCode = encode(crypto.randomUUID());
  await redis.setex(
    ACTIVATION_CODE_PREFIX + activationCode,
    cfg.get("USER_ACTIVATION_DELAY"),
    userUuid
  );
  return { userUuid, activationCode };
}
export async function removeUser(userUuid, activationCodeWithPrefix) {
  const userData = await pg.raw(
    "delete from account where uid = ? returning id",
    [userUuid]
  );
  const id = userData?.rows[0]?.id;
  await pg.raw("delete from account_roles where account_id = ?", [id]);

  if (activationCodeWithPrefix) {
    await redis.del(activationCodeWithPrefix);
  }
}

export async function getUser(userUuid, activationCodeWithPrefix) {
  const userData = await pg.raw("select * from account where uid = ?", [
    userUuid,
  ]);

  let redisUserId;
  if (activationCodeWithPrefix) {
    redisUserId = await redis.get(activationCodeWithPrefix);
  }
  return { user_id: userData.rows[0]?.uid, redisUserId, userData: userData.rows[0] };
}
export async function getAccessToken(userUuid) {
  const userData = await pg.raw(
    "select email, json_agg(role.name) as roles from account join account_roles on account.id = account_roles.account_id join role on account_roles.role_id = role.id where uid = ? group by email",
    [userUuid]
  );

  const email = userData?.rows[0]?.email;
  const roles = userData?.rows[0]?.roles || [];
  const user_id = encode(userUuid);

  return await jwtHelper.getAccessToken({ user_id, email, roles });
}

export async function getRefreshToken(userUuid) {
  const user_id = encode(userUuid);
  return await jwtHelper.getRefreshToken({ user_id });
}
