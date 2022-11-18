import React from 'react'
import classNames from 'classnames'

import { Dispatcher } from '../dispatcher'
import { DeviceRegisterState, DeviceRegisterStep } from '../../lib/stores'
import { assertNever } from '../../lib/fatal-error'
import { UiView } from '../ui-view'
import { Register } from './register'
import { CodeVerification } from './code-verification';
import { encodePathAsUrl } from '../../lib/path';

interface IDeviceRegisterProps {
  readonly dispatcher: Dispatcher
  readonly deviceRegisterState: DeviceRegisterState | null
}

interface IDeviceRegisterState {
  readonly currentStep: DeviceRegisterStep | null

  /**
   * Whether the welcome wizard is terminating. Used
   * in order to delay the actual dismissal of the view
   * such that the exit animations (defined in css) have
   * time to run to completion.
   */
  readonly exiting: boolean
}

/** The device register flow. */
export class DeviceRegister extends React.Component<IDeviceRegisterProps, IDeviceRegisterState> {
  public constructor(props: IDeviceRegisterProps) {
    super(props)

    this.state = {
      currentStep: DeviceRegisterStep.Register,
      exiting: false,
    }
  }

  public onCredentialsEntered = () => {
    console.log('hello');
  }

  public onCodeEntered = () => {
    console.log('code');
  }

  public componentWillReceiveProps(nextProps: IDeviceRegisterProps) {
    // this.advanceOnSuccessfulSignIn(nextProps)
  }

  public componentDidMount() {
    this.props.dispatcher.recordWelcomeWizardInitiated()
  }

  private getComponentForCurrentStep = () => {
    const step = this.state.currentStep
    const state = this.props.deviceRegisterState

    switch (step) {
      case DeviceRegisterStep.Register:
        return (
          <Register
            loading={state?.loading}
            error={state?.error}
            onSubmit={this.onCredentialsEntered}
          />
        )

      case DeviceRegisterStep.CodeVerification:
        return (
          <CodeVerification
            loading={state?.loading}
            error={state?.error}
            onOTPEntered={this.onCodeEntered}
          />
        )

      default:
        return assertNever(step as never, `Unknown welcome step: ${step}`)
    }
  }

  public render() {
    const className = classNames({
      exiting: this.state.exiting,
    });

    const brandingIcon = encodePathAsUrl(
      __dirname,
      'static/branding.svg'
    )

    return (
      <UiView id="device-register" className={className}>
        <div className="device-register-container">
          <div className="branding">
            <img src={brandingIcon} alt="branding-icon" />
            <div className="form-title">Đăng ký thiết bị</div>
          </div>
          <div className="device-register-content">
            {this.getComponentForCurrentStep()}
          </div>
        </div>
      </UiView>
    );
  }
}
