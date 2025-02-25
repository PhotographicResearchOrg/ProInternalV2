import { Component, ElementRef, QueryList, ViewChildren, Output, EventEmitter } from '@angular/core';
import { MessageService } from 'primeng/api';
import { FileAppService } from 'src/app/prointernalengine/components/apps/file/service/file.app.service';
import { DataService } from "src/app/services/data.service";
import * as XLSX from 'xlsx';
//import * as FileSaver from 'file-saver';
import { HttpClient, HttpEventType } from '@angular/common/http';


interface Image {
    name: string;
    objectURL: string;
}

@Component({
    selector: 'app-file-uploader',
    templateUrl: './uploader.component.html',
    providers: [MessageService]
})
export class UploaderComponent {

  @Output() reload: EventEmitter<void> = new EventEmitter<void>();

  reloadPage() {
    this.reload.emit();
  }



    uploadedFiles: any[] = [];
    public excelData: any[];
    @ViewChildren('buttonEl') buttonEl!: QueryList<ElementRef>;
    public excelDatas: any;
  constructor(
    private messageService: MessageService,
    private fileService: FileAppService,
    private dataService: DataService,
    private http: HttpClient
  ) { }


  onUpload(event: any) {

    //for (let file of event.files) {
    //  this.uploadedFiles.push(file);
    //}
    //const file = this.uploadedFiles[0];

    const file = event.files[0];
    const reader = new FileReader();
    var filename = file.name
    //var file_ext = filename.substr(filename.lastIndexOf('.'), filename.length);

    reader.onload = (e: any) => {
      const data = new Uint8Array(reader.result as ArrayBuffer);
      try
      {
        const workbook = XLSX.read(data, { type: 'buffer' });
        console.log('Workbook:', workbook);

        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        this.excelData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

        console.log('Excel data:', this.excelData);

        var jsonString = JSON.stringify(this.excelData);

        //ExcelUpload
        const blob = new Blob([jsonString], { type: "application/json" });
        const fileData = new File([blob], filename, { type: 'application/json' })

        this.dataService.uploadQuarterlyFile(

          fileData).subscribe(event => {
            this.reload.emit();
        
          });
      }
      catch (error)
      {
        console.error('Error reading file:', error);
      }
    };
    reader.readAsArrayBuffer(file);
    this.reload.emit();
  }
  


    onImageMouseOver(file: Image) {
        this.buttonEl.toArray().forEach(el => {
            el.nativeElement.id === file.name ? el.nativeElement.style.display = 'flex' : null;
        })
    }

    onImageMouseLeave(file: Image) {
        this.buttonEl.toArray().forEach(el => {
            el.nativeElement.id === file.name ? el.nativeElement.style.display = 'none' : null;
        })
    }

    removeImage(event: Event, file: any) {
        event.stopPropagation();
        this.uploadedFiles = this.uploadedFiles.filter(i => i !== file);
    }

}
