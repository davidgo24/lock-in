import { PrismaClient } from "@prisma/client";
import { hash } from "bcryptjs";
import { ensureDefaultData } from "../src/lib/bootstrap";

const prisma = new PrismaClient();

async function main() {
  const email = process.env.SEED_USER_EMAIL ?? "demo@example.com";
  const password = process.env.SEED_USER_PASSWORD ?? "password";

  const passwordHash = await hash(password, 10);

  const user = await prisma.user.upsert({
    where: { email },
    create: {
      email,
      passwordHash,
      displayName: "Demo",
    },
    update: {},
  });

  await ensureDefaultData(user.id);
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
