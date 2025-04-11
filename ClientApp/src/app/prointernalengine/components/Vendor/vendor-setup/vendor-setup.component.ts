import { Component, OnInit } from '@angular/core';
import { VendorUser } from 'src/app/models/vendor/vendoruser';
import { DataService } from 'src/app/services/data.service';

@Component({
  selector: 'app-vendor-setup',
  templateUrl: './vendor-setup.component.html',
  styleUrls: ['./vendor-setup.component.scss']
})
export class VendorSetupComponent implements OnInit {

  vendorUser: VendorUser = {
    company: { id: 0, name: '' }, 
    email: '',
    firstName: '',
    lastName: '',
    username: '',
    password: '',
    slug:''
  };

  userCreated = false;
  autoGeneratePassword = true;
  formInvalid = false;

  allVendors: { id: number; name: string }[] = [];
  filteredVendors: { id: number; name: string }[] = [];

  constructor(private dataService: DataService) { }

  ngOnInit(): void {
    this.dataService.getAllVendors().subscribe((vendors) => {
      console.log('All Vendors:', vendors);
      this.allVendors = vendors;
      this.filteredVendors = vendors;
    });
  }

  sendSetupDetails(): void {
    // Placeholder for sending user setup info (email, notification, etc.)
    // In a real app, you would call a backend service here.
    console.log(this.vendorUser);

    // Optionally show a toast or message
    // this.messageService.add({ severity: 'success', summary: 'Email Sent', detail: 'User setup details were sent successfully.' });
  }

  filterVendors(event: any): void {
    const query = event.query.toLowerCase();
    this.filteredVendors = this.allVendors.filter(v =>
      v.name.toLowerCase().includes(query)
    );
  }

  onVendorSelect(event: any): void {
    // Extract the actual vendor object
    const selectedVendor = event.value;

    // Ensure you're only storing the vendor object with id and name
    if (selectedVendor && selectedVendor.id && selectedVendor.name) {
      this.vendorUser.company = selectedVendor;
    } else {
      console.warn('Selected vendor does not have expected structure');
    }
  }

  generateRandomPassword(length = 10): string {
    const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%&';
    return Array.from({ length }, () => chars.charAt(Math.floor(Math.random() * chars.length))).join('');
  }

  onSubmit(): void {
    this.formInvalid = this.isFormInvalid();

    if (this.formInvalid) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }


    // Make sure company is stored as object with id and name
    const selectedCompany = this.vendorUser.company;
    if (typeof selectedCompany === 'object' && selectedCompany !== null) {
      this.vendorUser.company = { ...selectedCompany }; // Ensure a clean object clone
    }


    if (this.autoGeneratePassword) {
      this.vendorUser.password = this.generateRandomPassword();
    }

    this.userCreated = true;
    window.scrollTo({ top: 0, behavior: 'smooth' });

    this.dataService.saveVendor(this.vendorUser).subscribe(
      (response) => {
        this.userCreated = true;
        window.scrollTo({ top: 0, behavior: 'smooth' });
        console.log('Vendor saved successfully:', response);
      },
      (error) => {
        console.error('Error saving vendor:', error);
      }
    );
  }


  isFormInvalid(): boolean {
    return !this.vendorUser.company ||
      !this.vendorUser.email ||
      !this.vendorUser.firstName ||
      !this.vendorUser.lastName ||
      !this.vendorUser.username ||
      (!this.autoGeneratePassword && !this.vendorUser.password);
  }

  resetForm(): void {
    this.vendorUser = {
      company: { id: 0, name: '' }, 
      email: '',
      firstName: '',
      lastName: '',
      username: '',
      password: '',
      slug:''
    };
    this.userCreated = false;
    this.autoGeneratePassword = true;
    this.formInvalid = false;
  }
}
