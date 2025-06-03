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
    ID: 0,
    companyId: 0,
    companyName: '',
    email: '',
    firstName: '',
    lastName: '',
    username: '',
    password: '',
    slug: ''
  };

  userCreated = false;
  autoGeneratePassword = true;
  formInvalid = false;
  userID: number;
  submissionError: string | null = null;

  allVendors: { id: number; name: string }[] = [];
  filteredVendors: { id: number; name: string }[] = [];

  constructor(private dataService: DataService) { }

  ngOnInit(): void {
    this.dataService.getAllVendors().subscribe((vendors) => {
      this.allVendors = vendors;
      this.filteredVendors = vendors;
    });
  }

  sendSetupDetails(): void {

  }

  filterVendors(event: any): void {
    const query = event.query.toLowerCase();
    this.filteredVendors = this.allVendors.filter(v =>
      v.name.toLowerCase().includes(query)
    );
  }

  onVendorSelect(event: any): void {
    const selectedVendor = event.value;
    if (selectedVendor && selectedVendor.id && selectedVendor.name) {
      this.vendorUser.companyId = selectedVendor.id;
      this.vendorUser.companyName = selectedVendor.name;
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

    if (this.autoGeneratePassword) {
      this.vendorUser.password = this.generateRandomPassword();
    }

    this.userCreated = true;
    window.scrollTo({ top: 0, behavior: 'smooth' });

 

    // Uncomment to wire in backend
    
    this.dataService.saveVendor(this.vendorUser).subscribe({
      next: (response: any) => {
        this.userCreated = true;
        this.vendorUser.ID = response.UserId;
        this.submissionError = null;
        window.scrollTo({ top: 0, behavior: 'smooth' });

      },
      error: (err) => {
        this.submissionError = err.error || 'An error occurred while creating the user.';
        this.userCreated = false;
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    });
    
  }

  isFormInvalid(): boolean {
    return !this.vendorUser.companyName ||
      !this.vendorUser.email ||
      !this.vendorUser.firstName ||
      !this.vendorUser.lastName ||
      !this.vendorUser.username ||
      (!this.autoGeneratePassword && !this.vendorUser.password);
  }

  resetForm(): void {
    this.vendorUser = {
      ID: 0,
      companyId: 0,
      companyName: '',
      email: '',
      firstName: '',
      lastName: '',
      username: '',
      password: '',
      slug: ''
    };
    this.userCreated = false;
    this.autoGeneratePassword = true;
    this.formInvalid = false;
  }
}
