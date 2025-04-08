import { MapViolation } from 'src/app/models/Dashboard/MapViolation';

export interface MapViolationResponse {
  success: boolean;
  message: string;
  existingViolations: MapViolation[];
}
