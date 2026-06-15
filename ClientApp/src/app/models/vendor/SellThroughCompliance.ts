export interface SellThroughCompliance {

  account: number;

  memberName: string;

  missingWeekCount: number;

  missingWeeks: string;

  lastSubmission?: Date;

  contactName: string;

  contactEmail: string;

  brmName: string;

  brmEmail: string;
}
