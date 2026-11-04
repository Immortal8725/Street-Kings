export interface Runner {
  id: string;
  name: string;
  area: string;
  lat: number;
  lng: number;
  available: boolean;
}

export type JobStatus = 'assigned' | 'at_stall' | 'picked_up' | 'delivered';

export interface DeliveryJob {
  id: string;
  orderId: string;
  runnerId: string;
  runnerName: string;
  status: JobStatus;
  prepMinutes: number;
  travelMinutes: number;
  etaMinutes: number;
}
