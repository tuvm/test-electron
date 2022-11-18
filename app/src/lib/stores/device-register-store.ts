import { TypedBaseStore } from './base-store'
import { fatalError } from '../fatal-error';

/**
 * An enumeration of the possible steps that the device register
 * store can be in save for the uninitialized state (null).
 */
export enum DeviceRegisterStep {
  Register = 'Register',
  CodeVerification = 'CodeVerification',
  Success = 'Success',
}

/**
 * The union type of all possible states that the device register
 * store can be in save the uninitialized state (null).
 */
export type DeviceRegisterState =
  | IRegisterState
  | ICodeVerificationState
  | ISuccessState

/**
 * Base interface for shared properties between states
 */
export interface IDeviceRegisterState {
  /**
   * The device register step represented by this state
   */
  readonly step: DeviceRegisterStep

  /**
   * An error which, if present, should be presented to the
   * user in close proximity to the actions or input fields
   * related to the current step.
   */
  readonly error: Error | null

  /**
   * A value indicating whether or not the device register store is
   * busy processing a request. While this value is true all
   * form inputs and actions save for a cancel action should
   * be disabled and the user should be made aware that the
   * device register process is ongoing.
   */
  readonly loading: boolean
}

/**
 * State interface representing the Authentication step where
 * the user provides credentials and/or initiates a browser
 * OAuth sign in process. This step occurs as the first step
 * when signing in to GitHub.com and as the second step when
 * signing in to a GitHub Enterprise instance.
 */
export interface IRegisterState extends IDeviceRegisterState {
  readonly step: DeviceRegisterStep.Register
}

/**
 * State interface representing the TwoFactorAuthentication
 * step where the user provides an OTP token. This step
 * occurs after the authentication step both for GitHub.com,
 * and GitHub Enterprise when the user has enabled two
 * factor authentication on the host.
 */
export interface ICodeVerificationState extends IDeviceRegisterState {
  readonly step: DeviceRegisterStep.CodeVerification

  /**
   * The primary server that the hotel locate
   */
  readonly primaryServer: string

  /**
   * Name of the register device
   */
  readonly deviceName: string

  /**
   * Description of the device
   */
  readonly deviceDescription: string
}

/**
 * Sentinel step representing a successful sign in process. Sign in
 * components may use this as a signal to dismiss the ongoing flow
 * or to show a message to the user indicating that they've been
 * successfully signed in.
 */
export interface ISuccessState extends IDeviceRegisterState {
  readonly step: DeviceRegisterStep.Success
}

/**
 * A store encapsulating all logic related to registering a device
 * to Vinpearl OCR system
 */
export class DeviceRegisterStore extends TypedBaseStore<DeviceRegisterState | null> {
  private state: DeviceRegisterState | null = {
    step: DeviceRegisterStep.Register,
    error: null,
    loading: false,
  }

  /**
   * Returns the current state of the sign in store or null if
   * no sign in process is in flight.
   */
  public getState(): DeviceRegisterState | null {
    return this.state
  }

  /**
   * Update the internal state of the store and emit an update
   * event.
   */
  private setState(state: DeviceRegisterState | null) {
    this.state = state
    this.emitUpdate(this.getState())
  }

  /**
   * Clear any in-flight sign in state and return to the
   * initial (no sign-in) state.
   */
  public reset() {
    this.setState(null)
  }

  public beginDeviceRegister() {
    this.setState({
      step: DeviceRegisterStep.Register,
      error: null,
      loading: false,
    })
  }

  public async registerDevice(
    hotel: string,
    deviceName: string,
    deviceDescription: string
  ): Promise<void> {
    const currentState = this.state;
    console.log(currentState, hotel, deviceName, deviceDescription);

    if (!currentState || currentState.step !== DeviceRegisterStep.Register) {
      const stepText = currentState ? currentState.step : 'null'
      return fatalError(
        `Device register step '${stepText}' not compatible with authentication`
      )
    }

    this.setState({ ...currentState, loading: true });

    setTimeout(() => {
      this.setState({
        step: DeviceRegisterStep.CodeVerification,
        error: null,
        loading: false,
      } as DeviceRegisterState)
      this.emitUpdate(this.getState())
    }, 200);

  }

  public async verifyCode(
    code: string,
  ): Promise<void> {
    const currentState = this.state;
    console.log(currentState, code);

    if (!currentState || currentState.step !== DeviceRegisterStep.CodeVerification) {
      const stepText = currentState ? currentState.step : 'null'
      return fatalError(
        `Device register step '${stepText}' not compatible with authentication`
      )
    }

    this.setState({ ...currentState, loading: true });

    setTimeout(() => {
      this.setState({
        step: DeviceRegisterStep.Success,
        error: null,
        loading: false,
      })
      this.emitUpdate(this.getState())
    }, 200);

  }
}
