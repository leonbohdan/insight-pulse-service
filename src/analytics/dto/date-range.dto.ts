import { IsDate, IsNotEmpty } from 'class-validator';
import { Type } from 'class-transformer';

export class DateRangeDto {
  @IsNotEmpty()
  @Type(() => Date)
  @IsDate()
  startDate: Date;

  @IsNotEmpty()
  @Type(() => Date)
  @IsDate()
  endDate: Date;
}
