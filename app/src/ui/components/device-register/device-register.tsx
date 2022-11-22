import React from 'react'
import classNames from 'classnames'

import { Dispatcher } from '../../../dispatcher'
import { DeviceRegisterState, DeviceRegisterStep } from '../../../stores'
import { assertNever } from '../../../lib/fatal-error'
import { UiView } from '../../common/ui-view'
import { Register } from './register'
import { CodeVerification } from './code-verification';
import { encodePathAsUrl } from '../../../lib/path';

interface IDeviceRegisterProps {
  readonly dispatcher: Dispatcher
  readonly deviceRegisterState: DeviceRegisterState | null
}

interface IDeviceRegisterState {
  // readonly currentStep: DeviceRegisterStep | null

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
      // currentStep: DeviceRegisterStep.Register,
      exiting: false,
    }

    this.props.dispatcher.beginDeviceRegister();
  }

  public onDeviceRegister = (hotel: string, deviceName: string, deviceDesciption: string) => {
    this.props.dispatcher.registerDevice(hotel, deviceName, deviceDesciption);
  }

  public onCodeEntered = (code: string) => {
    this.props.dispatcher.verifyCode(code);
  }

  public componentWillReceiveProps(nextProps: IDeviceRegisterProps) {
    // this.advanceOnSuccessfulSignIn(nextProps)
  }

  public componentDidMount() {
    this.props.dispatcher.recordDeviceRegisterWizardInitiated()
  }

  private getComponentForCurrentStep = () => {
    const state = this.props.deviceRegisterState;
    const step = state?.step;

    switch (step) {
      case DeviceRegisterStep.Register:
        return (
          <Register
            loading={state?.loading}
            error={state?.error}
            onSubmit={this.onDeviceRegister}
          />
        )

      case DeviceRegisterStep.CodeVerification:
        return (
          <CodeVerification
            loading={state?.loading}
            error={state?.error}
            onCodeEntered={this.onCodeEntered}
          />
        )

      case DeviceRegisterStep.Success:
        return (
          <div className="form-title">Thành công</div>
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
