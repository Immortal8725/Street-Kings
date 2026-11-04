import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { CheckoutService } from '../checkout/checkout.service';
import { haversineKm } from '../common/geo';
import { IdFactory } from '../common/ids';
import { SellersService } from '../sellers/sellers.service';
import { DeliveryJob, JobStatus, Runner } from './delivery.types';

const NEXT: Record<JobStatus, JobStatus | null> = {
  assigned: 'at_stall',
  at_stall: 'picked_up',
  picked_up: 'delivered',
  delivered: null,
};

@Injectable()
export class DeliveryService {
  private readonly runners: Runner[] = [
    { id: 'runner_ayesha', name: 'Ayesha', area: 'Maboneng', lat: -26.202, lng: 28.058, available: true },
    { id: 'runner_thabo', name: 'Thabo', area: 'Soweto', lat: -26.248, lng: 27.854, available: true },
    { id: 'runner_nomsa', name: 'Nomsa', area: 'Khayelitsha', lat: -34.038, lng: 18.677, available: true },
  ];

  private readonly jobs = new Map<string, DeliveryJob>();

  constructor(
    private readonly ids: IdFactory,
    private readonly sellers: SellersService,
    private readonly checkout: CheckoutService,
  ) {}

  listRunners(): Runner[] {
    return this.runners.map((runner) => ({ ...runner }));
  }

  dispatch(orderId: string): DeliveryJob {
    const order = this.checkout.get(orderId);
    if (order.fulfillment !== 'runner') {
      throw new BadRequestException('Pickup orders stay at the stall');
    }
    if (order.status !== 'paid') throw new BadRequestException('Order is not paid for dispatch');
    const stall = this.sellers.get(order.stallId);
    const runner = this.nearest(stall.lat, stall.lng);
    runner.available = false;
    const travelMinutes = Math.max(5, Math.round(haversineKm(runner.lat, runner.lng, stall.lat, stall.lng) * 4));
    const job: DeliveryJob = {
      id: this.ids.next('job'),
      orderId: order.id,
      runnerId: runner.id,
      runnerName: runner.name,
      status: 'assigned',
      prepMinutes: order.prepMinutes,
      travelMinutes,
      etaMinutes: order.prepMinutes + travelMinutes,
    };
    this.jobs.set(job.id, job);
    this.checkout.mark(order.id, 'preparing');
    return job;
  }

  advance(jobId: string): DeliveryJob {
    const job = this.jobs.get(jobId);
    if (!job) throw new NotFoundException(`Delivery ${jobId} not found`);
    const next = NEXT[job.status];
    if (!next) throw new BadRequestException('Delivery is already complete');
    job.status = next;
    if (next === 'picked_up') this.checkout.mark(job.orderId, 'out_for_delivery');
    if (next === 'delivered') {
      this.checkout.mark(job.orderId, 'delivered');
      const runner = this.runners.find((item) => item.id === job.runnerId);
      if (runner) runner.available = true;
    }
    return job;
  }

  private nearest(lat: number, lng: number): Runner {
    const ranked = [...this.runners]
      .filter((runner) => runner.available)
      .sort(
        (a, b) =>
          haversineKm(lat, lng, a.lat, a.lng) - haversineKm(lat, lng, b.lat, b.lng) ||
          a.id.localeCompare(b.id),
      );
    if (!ranked.length) throw new BadRequestException('No runners nearby');
    return ranked[0];
  }
}
