/**
 * 依赖注入容器 (Dependency Injection Container)
 * Phase 3: 模块化重构 - 控制反转 (IoC)
 *
 * 基于 Service Locator 模式,实现单例管理和依赖自动解析
 *
 * 设计原则:
 * - Single Responsibility: 只负责服务注册和解析
 * - Dependency Inversion: 高层模块不依赖低层模块,都依赖抽象
 * - Open/Closed: 对扩展开放,对修改关闭
 *
 * @module AppContainer
 * @author Ziming Wang & Claude
 * @date 2025-11-04
 */

/**
 * 服务工厂函数类型
 * @callback ServiceFactory
 * @param {AppContainer} container - 容器实例,用于获取依赖
 * @returns {*} 服务实例
 */

/**
 * 服务配置类型
 * @typedef {Object} ServiceConfig
 * @property {ServiceFactory} factory - 服务工厂函数
 * @property {*} instance - 服务实例 (懒加载,首次获取时创建)
 * @property {boolean} singleton - 是否单例 (默认 true)
 * @property {string[]} dependencies - 依赖列表 (用于循环依赖检测)
 */

/**
 * 应用容器 - 依赖注入核心
 *
 * 功能:
 * 1. 服务注册 (register)
 * 2. 服务获取 (get)
 * 3. 单例管理 (自动)
 * 4. 循环依赖检测
 * 5. 生命周期管理
 *
 * @example
 * const container = new AppContainer();
 *
 * // 注册服务
 * container.register('logger', () => new Logger('App'));
 * container.register('config', () => configManager);
 * container.register('audioIO', (c) => new AudioIO(c.get('config'), c.get('logger')));
 *
 * // 获取服务 (自动创建并缓存)
 * const audioIO = container.get('audioIO');
 */
export class AppContainer {
  /**
   * 创建容器实例
   */
  constructor() {
    /**
     * 服务注册表
     * @type {Map<string, ServiceConfig>}
     */
    this.services = new Map();

    /**
     * 正在创建的服务 (用于循环依赖检测)
     * @type {Set<string>}
     */
    this.creating = new Set();

    /**
     * 调试模式
     * @type {boolean}
     */
    this.debug = false;
  }

  /**
   * 注册服务
   *
   * @param {string} name - 服务名称 (唯一标识符)
   * @param {ServiceFactory} factory - 服务工厂函数
   * @param {Object} options - 选项
   * @param {boolean} [options.singleton=true] - 是否单例
   * @param {string[]} [options.dependencies=[]] - 显式声明的依赖列表
   * @throws {Error} 如果服务名已存在
   *
   * @example
   * container.register('logger', () => new Logger('App'));
   * container.register('audioIO', (c) => new AudioIO(c.get('logger')), {
   *   singleton: true,
   *   dependencies: ['logger']
   * });
   */
  register(name, factory, options = {}) {
    if (this.services.has(name)) {
      throw new Error(`[AppContainer] 服务 "${name}" 已存在,无法重复注册`);
    }

    if (typeof factory !== 'function') {
      throw new TypeError(`[AppContainer] 服务 "${name}" 的工厂必须是函数`);
    }

    const config = {
      factory,
      instance: null,
      singleton: options.singleton !== false, // 默认单例
      dependencies: options.dependencies || []
    };

    this.services.set(name, config);

    if (this.debug) {
      console.log(`[AppContainer] ✅ 注册服务: ${name}`, {
        singleton: config.singleton,
        dependencies: config.dependencies
      });
    }
  }

  /**
   * 获取服务实例
   *
   * - 首次获取: 调用工厂函数创建实例
   * - 再次获取: 返回缓存的实例 (单例模式)
   * - 自动解析依赖
   * - 检测循环依赖
   *
   * @param {string} name - 服务名称
   * @returns {*} 服务实例
   * @throws {Error} 如果服务未注册或存在循环依赖
   *
   * @example
   * const logger = container.get('logger');
   * const audioIO = container.get('audioIO'); // 自动注入 logger
   */
  get(name) {
    const config = this.services.get(name);

    if (!config) {
      throw new Error(
        `[AppContainer] 服务 "${name}" 未注册\n` +
        `可用服务: ${Array.from(this.services.keys()).join(', ')}`
      );
    }

    // 返回已创建的单例
    if (config.singleton && config.instance !== null) {
      return config.instance;
    }

    // 循环依赖检测
    if (this.creating.has(name)) {
      const chain = Array.from(this.creating).join(' → ') + ` → ${name}`;
      throw new Error(
        `[AppContainer] 检测到循环依赖:\n${chain}\n` +
        `请检查服务的构造函数,避免相互依赖`
      );
    }

    // 标记正在创建
    this.creating.add(name);

    try {
      if (this.debug) {
        console.log(`[AppContainer] 🔨 创建服务: ${name}`);
      }

      // 调用工厂函数创建实例
      const instance = config.factory(this);

      // 缓存单例
      if (config.singleton) {
        config.instance = instance;
      }

      if (this.debug) {
        console.log(`[AppContainer] ✅ 服务已创建: ${name}`);
      }

      return instance;
    } catch (error) {
      console.error(`[AppContainer] ❌ 创建服务失败: ${name}`, error);
      throw error;
    } finally {
      // 移除创建标记
      this.creating.delete(name);
    }
  }

  /**
   * 检查服务是否已注册
   *
   * @param {string} name - 服务名称
   * @returns {boolean} 是否已注册
   */
  has(name) {
    return this.services.has(name);
  }

  /**
   * 获取所有已注册的服务名称
   *
   * @returns {string[]} 服务名称列表
   */
  getServiceNames() {
    return Array.from(this.services.keys());
  }

  /**
   * 清空容器 (主要用于测试)
   *
   * @param {string} [name] - 可选,只清空指定服务
   */
  clear(name) {
    if (name) {
      this.services.delete(name);
      if (this.debug) {
        console.log(`[AppContainer] 🗑️  清空服务: ${name}`);
      }
    } else {
      this.services.clear();
      this.creating.clear();
      if (this.debug) {
        console.log('[AppContainer] 🗑️  清空所有服务');
      }
    }
  }

  /**
   * 启用/禁用调试模式
   *
   * @param {boolean} enabled - 是否启用
   */
  setDebug(enabled) {
    this.debug = enabled;
    console.log(`[AppContainer] 调试模式: ${enabled ? '启用' : '禁用'}`);
  }

  /**
   * 获取容器状态 (用于调试)
   *
   * @returns {Object} 容器状态
   */
  getStatus() {
    const services = Array.from(this.services.entries()).map(([name, config]) => ({
      name,
      singleton: config.singleton,
      created: config.instance !== null,
      dependencies: config.dependencies
    }));

    return {
      totalServices: this.services.size,
      createdServices: services.filter(s => s.created).length,
      services
    };
  }

  /**
   * 打印容器状态 (调试用)
   */
  printStatus() {
    const status = this.getStatus();
    console.log('[AppContainer] 容器状态:');
    console.log(`  总服务数: ${status.totalServices}`);
    console.log(`  已创建: ${status.createdServices}`);
    console.table(status.services);
  }
}

/**
 * 创建全局容器实例 (单例)
 *
 * 注意: 这是一个全局单例,整个应用共享
 * 如果需要测试隔离,可以在测试中创建独立的容器实例
 */
let globalContainer = null;

/**
 * 获取全局容器实例
 *
 * @returns {AppContainer} 全局容器
 *
 * @example
 * import { getGlobalContainer } from './core/app-container.js';
 *
 * const container = getGlobalContainer();
 * const logger = container.get('logger');
 */
export function getGlobalContainer() {
  if (!globalContainer) {
    globalContainer = new AppContainer();
  }
  return globalContainer;
}

/**
 * 重置全局容器 (主要用于测试)
 */
export function resetGlobalContainer() {
  globalContainer = null;
}

// 默认导出容器类
export default AppContainer;
