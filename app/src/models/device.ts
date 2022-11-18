/**
 * Returns a value indicating whether two device instances
 * can be considered equal. Equality is determined by comparing
 * the two instances' server and device id.
 */
export function deviceEquals(x: Device, y: Device) {
  return x.primaryServer === y.primaryServer && x.id === y.id
}

/**
 * The registered device
 */
export class Device {
  public static anonymous(): Device {
    return new Device('', '', '', -1)
  }

  /**
   * Create an instance of an device
   *
   * @param primaryServer The server where the hotel locate
   * @param name The name of device
   * @param description The description of device
   * @param id The id that be generated for device.
   */
  public constructor(
    public readonly primaryServer: string,
    public readonly name: string,
    public readonly description: string,
    public readonly id: number,
  ) {}

  /**
   * Get a name to display
   *
   * This will by default return the 'name' as it is the friendly name.
   * However, if not defined, we return unknown
   */
  public get friendlyName(): string {
    return this.name !== '' ? this.name : 'Unknown';
  }
}
