import { Component, OnInit } from '@angular/core'
import { FormBuilder, FormControl, Validators } from '@angular/forms'
import { OpenhabService } from '../openhab.service'
@Component({
  selector: 'app-setup',
  templateUrl: './setup.component.html',
  styleUrls: ['./setup.component.scss']
})
export class SetupComponent {
  constructor(
    public openhabService: OpenhabService,
    private formBuilder: FormBuilder
  ) {}

  apiTokenForm = this.formBuilder.group({
    apiToken: ['', Validators.required]
  })

  submitAPIToken() {
    this.apiTokenForm.markAllAsTouched()
    if (this.apiTokenForm.invalid) {
      return
    }

    this.openhabService
      .register(this.apiTokenForm.controls['apiToken'].value || '')
      .subscribe({
        next: (response) => {
          if (!response?.success) {
            this.apiTokenForm.controls['apiToken'].setErrors({
              invalidToken: true
            })
            return
          }

          this.apiTokenForm.reset()
        },
        error: (response) => {
          this.apiTokenForm.controls['apiToken'].setErrors({
            connection: true
          })
        }
      })
  }
}
