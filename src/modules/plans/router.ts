import type { FastifyRequest } from "fastify";
import {
  adminProcedure,
  publicProcedure,
  router,
  trpcError,
} from "../../trpc/core";
import db, { schema } from "../../db/client";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { randomUUID } from "crypto";

type PlansRequest = FastifyRequest<{
  Querystring: { planId: string };
}>;

const find = publicProcedure.query(async ({ ctx }) => {
  const req = ctx.req as PlansRequest;
  const planId = req.query.planId;

  if (!planId) {
    throw new trpcError({
      code: "NOT_FOUND",
    });
  }

  const plan = await db.query.plans.findFirst({
    where: eq(schema.plans.id, planId),
  });

  if (!plan) {
    throw new trpcError({
      code: "NOT_FOUND",
    });
  }

  return plan;
});

const create = adminProcedure
  .input(z.object({ name: z.string(), price: z.number() }))
  .mutation(async ({ input }) => {
    const plan = await db.query.plans.findFirst({
      where: eq(schema.plans.name, input.name),
    });

    if (plan) {
      throw new trpcError({
        code: "BAD_REQUEST",
        message: "Plan with the same name already exists",
      });
    }

    const [createdPlan] = await db
      .insert(schema.plans)
      .values({
        id: randomUUID(),
        name: input.name,
        price: input.price,
      })
      .returning();

    return createdPlan;
  });

const update = adminProcedure
  .input(z.object({ id: z.string(), name: z.string(), price: z.number() }))
  .mutation(async ({ input }) => {
    const plan = await db.query.plans.findFirst({
      where: eq(schema.plans.id, input.id),
    });

    if (!plan) {
      throw new trpcError({
        code: "BAD_REQUEST",
        message: "No plan to update",
      });
    }

    // to ensure only needed values are updated, and no additional values are provided to input
    const dataToUpdate = {
      ...(input.name ? { name: input.name } : {}),
      ...(input.price ? { price: input.price } : {}),
    };

    const [updatedPlan] = await db
      .update(schema.plans)
      .set(dataToUpdate)
      .where(eq(schema.plans.id, input.id))
      .returning();

    return updatedPlan;
  });

const checkUpgradePrice = publicProcedure
  .input(
    z.object({
      currentPlanId: z.string(),
      newPlanId: z.string(),
      daysRemaining: z.number(),
    })
  )
  .query(async ({ input }) => {
    const currentPlan = await db.query.plans.findFirst({
      where: eq(schema.plans.id, input.currentPlanId),
    });

    const newPlan = await db.query.plans.findFirst({
      where: eq(schema.plans.id, input.newPlanId),
    });

    if (!currentPlan || !newPlan) {
      throw new trpcError({
        code: "BAD_REQUEST",
        message: "Invalid params",
      });
    }

    const daysInMonth = 30;

    const dailyCostOfCurrentPlan = currentPlan.price / daysInMonth;
    const consumptionSoFar =
      dailyCostOfCurrentPlan * (daysInMonth - input.daysRemaining);
    const remainingCost = newPlan.price - consumptionSoFar;

    return {
      amount: remainingCost,
      message: `You will need to pay ${remainingCost} to upgrade`,
    };
  });

export const plans = router({
  find,
  create,
  update,
  checkUpgradePrice,
});
