import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  await prisma.appSettings.upsert({
    where: { id: "default" },
    create: { id: "default", weeklyGoalHours: 7 },
    update: {},
  });

  const misc = await prisma.project.findFirst({ where: { isMisc: true } });
  if (!misc) {
    await prisma.project.create({
      data: { name: "Misc. tasks", isMisc: true },
    });
  }
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
