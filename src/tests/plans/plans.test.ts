import { beforeAll, describe, expect, it } from "vitest";
import { db, schema } from "../../db/client";
import { createAuthenticatedCaller, createCaller, setupUser } from "../helpers/utils";
import resetDb from "../helpers/resetDb";
import { eq } from "drizzle-orm";

describe("plans", async () => {
  const user = {
    email: "mail@mail.com",
    password: "P@ssw0rd",
    name: "test",
    timezone: "Asia/Riyadh",
    locale: "en",
    isAdmin: true,
  };

  let adminInstance;
  beforeAll(async () => {
    await resetDb();

    await createCaller({}).auth.register(user);
    const userInDb = await db.query.users.findFirst({
      where: eq(schema.users.email, user.email),
    });
    adminInstance = await createAuthenticatedCaller({
      userId: userInDb!.id,
    })
  });

  describe("create", async () => {
    const plan = {
      name: "fakePlanName",
      price: 30.5,
    };
    it("should create a plan when user is an admin", async () => {
      await adminInstance!.plans.find({ ctx: { req: { query: { planId: 'id' } }}});
      const createdPlan = await db.query.plans.findFirst({
        where: eq(schema.plans.name, plan.name),
      });
      expect(createdPlan?.price).toBe(plan.price);
      expect(createdPlan?.name).toBe(plan.name);
    });
  });
});
