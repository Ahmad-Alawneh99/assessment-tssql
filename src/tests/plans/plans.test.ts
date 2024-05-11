import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { db, schema } from "../../db/client";
import { createAuthenticatedCaller, createCaller } from "../helpers/utils";
import resetDb from "../helpers/resetDb";
import { eq } from "drizzle-orm";

describe("plans", async () => {
  let adminInstance;
  beforeAll(async () => {
    const user = {
      email: "admin@mail.com",
      password: "P@ssw0rd",
      name: "test",
      timezone: "Asia/Riyadh",
      locale: "en",
      isAdmin: true,
      id: 12,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    await resetDb();

    const [userInDb] = await db.insert(schema.users).values(user).returning();
    adminInstance = await createAuthenticatedCaller({
      userId: userInDb!.id,
    });
  });

  afterAll(async () => {
    await resetDb();
  });

  describe("find", async () => {
    beforeAll(async () => {
      await db.insert(schema.plans).values({
        id: "fakeId",
        name: "fakeName",
        price: 15,
      });
    });

    it("should return plan correctly when found", async () => {
      const result = await createCaller({}).plans.find({ planId: "fakeId" });

      expect(result!.name).toBe("fakeName");
      expect(result!.price).toBe(15);
    });

    it("should return undefined if plan is not found", async () => {
      const result = await createCaller({}).plans.find({
        planId: "fakeNotFoundId",
      });

      expect(result).toBeUndefined();
    });
  });

  describe("create", async () => {
    it("should create a plan when user is an admin", async () => {
      const plan = {
        name: "fakePlanName",
        price: 30.5,
      };

      await adminInstance!.plans.create(plan);
      const createdPlan = await db.query.plans.findFirst({
        where: eq(schema.plans.name, plan.name),
      });
      expect(createdPlan?.price).toBe(plan.price);
      expect(createdPlan?.name).toBe(plan.name);
    });
  });

  describe("update", () => {
    it("should update a plan when user is an admin", async () => {
      const plan = {
        name: "fakePlanName2",
        price: 30.5,
      };

      await adminInstance!.plans.create(plan);
      const createdPlan = await db.query.plans.findFirst({
        where: eq(schema.plans.name, plan.name),
      });

      const updatedPlan = await adminInstance!.plans.update({
        id: createdPlan?.id,
        name: "new name",
        price: 100,
      });

      expect(updatedPlan?.price).toBe(100);
      expect(updatedPlan?.name).toBe("new name");
    });
  });

  describe("checkUpgradePrice", () => {
    it("should calculate upgrade cost correctly", async () => {
      const oldPlan = {
        name: "oldPlan",
        price: 30,
      };

      const newPlan = {
        name: "newPlan",
        price: 60,
      };

      const createdOldPlan = await adminInstance!.plans.create(oldPlan);
      const createdNewPlan = await adminInstance!.plans.create(newPlan);

      const result = await createCaller({}).plans.checkUpgradePrice({
        currentPlanId: createdOldPlan.id,
        newPlanId: createdNewPlan.id,
        daysRemaining: 15,
      });

      expect(result.amount).toBe(45);
    });
  });
});
