import { Pipe, PipeTransform } from '@angular/core';

/** The label of a select's current value, for read-only fields on the product sheet. */
@Pipe({ name: 'sheetOption' })
export class SheetOptionPipe implements PipeTransform {
  transform(options: { value: any; label: string }[], value: any): string {
    return options.find(o => String(o.value) === String(value))?.label ?? String(value ?? '—');
  }
}
