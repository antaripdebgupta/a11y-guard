import { prisma } from './client.js';

async function seed() {
  console.log('Seeding database with fixture data...');

  // Create Organization
  const org = await prisma.organization.upsert({
    where: { slug: 'acme-corp' },
    update: {},
    create: {
      name: 'Acme Corporation',
      slug: 'acme-corp',
    },
  });

  // Create User
  const user = await prisma.user.upsert({
    where: { email: 'dev@acme.com' },
    update: {},
    create: {
      email: 'dev@acme.com',
      name: 'Acme Developer',
      avatarUrl: 'https://github.com/ghost.png',
    },
  });

  // Link OrganizationMember
  await prisma.organizationMember.upsert({
    where: {
      organizationId_userId: {
        organizationId: org.id,
        userId: user.id,
      },
    },
    update: {},
    create: {
      organizationId: org.id,
      userId: user.id,
      role: 'OWNER',
    },
  });

  // Create Repository
  const repo = await prisma.repository.upsert({
    where: { githubRepoId: 987654321 },
    update: {},
    create: {
      organizationId: org.id,
      githubRepoId: 987654321,
      name: 'web-app',
      fullName: 'acme-corp/web-app',
      isPrivate: true,
    },
  });

  // Create Scan with two violations
  const scan = await prisma.scan.create({
    data: {
      repositoryId: repo.id,
      commitSha: 'a1b2c3d4e5f6',
      status: 'COMPLETED',
      score: 85.5,
      startedAt: new Date(),
      completedAt: new Date(),
      violations: {
        create: [
          {
            ruleId: 'color-contrast',
            impact: 'CRITICAL',
            description: 'Element has insufficient color contrast ratio of 2.5:1',
            helpUrl: 'https://dequeuniversity.com/rules/axe/4.4/color-contrast',
            htmlSnippet: '<button class="bg-light-gray text-white">Click Me</button>',
            targetSelector: 'body > main > button',
          },
          {
            ruleId: 'image-alt',
            impact: 'SERIOUS',
            description: 'Image element does not have an alt attribute',
            helpUrl: 'https://dequeuniversity.com/rules/axe/4.4/image-alt',
            htmlSnippet: '<img src="/hero.png">',
            targetSelector: 'body > header > img',
          },
        ],
      },
    },
  });

  console.log(`Database seeded successfully! Created scan ${scan.id}`);
}

seed()
  .catch((e) => {
    console.error('Error seeding database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
