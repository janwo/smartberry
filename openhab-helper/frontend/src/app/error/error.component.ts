import { Component, Input } from '@angular/core'
import { AbstractControl, FormArray, FormGroup } from '@angular/forms'

@Component({
  selector: 'app-error',
  templateUrl: './error.component.html',
  styleUrls: ['./error.component.scss']
})
export class ErrorComponent {
  @Input() form?: FormGroup
  @Input() errors?: { [key: string]: string }

  public findError(
    control: AbstractControl
  ): { [key: string]: boolean } | undefined {
    if (control instanceof FormGroup) {
      for (const groupControl of Object.values(control.controls)) {
        const error = this.findError(groupControl)
        if (error != undefined) {
          return error
        }
      }
    } else if (control instanceof FormArray) {
      for (const arrayControl of (control as FormArray).controls) {
        const error = this.findError(arrayControl)
        if (error != undefined) {
          return error
        }
      }
    } else if (control.touched) {
      for (const error of Object.keys(control.errors || {})) {
        const returned: { [key: string]: boolean } = {}
        returned[error] = true
        return returned
      }
    }
    return undefined
  }
}
