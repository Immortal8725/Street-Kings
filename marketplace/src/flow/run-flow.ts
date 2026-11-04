import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { MarketFlowService } from './market-flow.service';

async function main(): Promise<void> {
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error'] });
  try {
    const trace = app.get(MarketFlowService).walkthrough();
    const lines = trace.steps.map((step, index) => `${index + 1}. ${step.phase} / ${step.stage}`);
    console.log(lines.join('\n'));
    console.log(
      JSON.stringify(
        {
          ok: true,
          stages: trace.steps.length,
          deliveredOrderId: trace.deliveredOrderId,
          stock: trace.stock,
          referralCents: trace.referralCents,
          reorderId: trace.reorderId,
        },
        null,
        2,
      ),
    );
  } finally {
    await app.close();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
