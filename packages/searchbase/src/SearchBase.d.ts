import Base from './Base';
import type { BaseConfig, ComponentConfig } from './types';
import Component from './Component';

export default class SearchBase extends Base {
    constructor({
        index,
        url,
        credentials,
        headers,
        appbaseConfig
      }: BaseConfig)

      // To register a component
  register(componentId: string, component: Component | ComponentConfig): void

  // To un-register a component
  unregister(componentId: string): void

  // To get component instance
  getComponent(componentId: string): Component

  // To get the list of registered components
  getComponents(): { [key: string]: Component }
}
