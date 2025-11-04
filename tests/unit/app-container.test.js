/**
 * AppContainer 单元测试
 * Phase 3: 模块化重构 - 依赖注入容器测试
 *
 * @see js/core/app-container.js
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { AppContainer } from '../../js/core/app-container.js';

describe('AppContainer', () => {
  let container;

  beforeEach(() => {
    container = new AppContainer();
  });

  describe('register()', () => {
    it('should register a service successfully', () => {
      container.register('logger', () => ({ log: () => {} }));

      expect(container.has('logger')).toBe(true);
    });

    it('should throw error when registering duplicate service', () => {
      container.register('logger', () => ({ log: () => {} }));

      expect(() => {
        container.register('logger', () => ({ log: () => {} }));
      }).toThrow('服务 "logger" 已存在');
    });

    it('should throw error when factory is not a function', () => {
      expect(() => {
        container.register('logger', 'not-a-function');
      }).toThrow('工厂必须是函数');
    });

    it('should register service with options', () => {
      container.register('logger', () => ({}), {
        singleton: false,
        dependencies: ['config']
      });

      const config = container.services.get('logger');
      expect(config.singleton).toBe(false);
      expect(config.dependencies).toEqual(['config']);
    });
  });

  describe('get()', () => {
    it('should create service instance on first get', () => {
      let created = false;
      container.register('logger', () => {
        created = true;
        return { log: () => {} };
      });

      const logger = container.get('logger');

      expect(created).toBe(true);
      expect(logger).toHaveProperty('log');
    });

    it('should return cached instance on subsequent gets (singleton)', () => {
      let createCount = 0;
      container.register('logger', () => {
        createCount++;
        return { id: createCount };
      });

      const logger1 = container.get('logger');
      const logger2 = container.get('logger');

      expect(createCount).toBe(1);
      expect(logger1).toBe(logger2); // Same instance
    });

    it('should create new instance each time (non-singleton)', () => {
      let createCount = 0;
      container.register('logger', () => ({ id: createCount++ }), {
        singleton: false
      });

      const logger1 = container.get('logger');
      const logger2 = container.get('logger');

      expect(logger1.id).toBe(0);
      expect(logger2.id).toBe(1);
      expect(logger1).not.toBe(logger2); // Different instances
    });

    it('should throw error when service not registered', () => {
      expect(() => {
        container.get('unknown');
      }).toThrow('服务 "unknown" 未注册');
    });

    it('should auto-inject dependencies', () => {
      container.register('config', () => ({ port: 3000 }));
      container.register('logger', (c) => {
        const config = c.get('config');
        return { log: (msg) => `[${config.port}] ${msg}` };
      });

      const logger = container.get('logger');
      expect(logger.log('test')).toBe('[3000] test');
    });

    it('should detect circular dependencies', () => {
      container.register('serviceA', (c) => {
        return { b: c.get('serviceB') };
      });
      container.register('serviceB', (c) => {
        return { a: c.get('serviceA') };
      });

      expect(() => {
        container.get('serviceA');
      }).toThrow('检测到循环依赖');
    });
  });

  describe('has()', () => {
    it('should return true for registered service', () => {
      container.register('logger', () => ({}));
      expect(container.has('logger')).toBe(true);
    });

    it('should return false for unregistered service', () => {
      expect(container.has('unknown')).toBe(false);
    });
  });

  describe('getServiceNames()', () => {
    it('should return all registered service names', () => {
      container.register('logger', () => ({}));
      container.register('config', () => ({}));
      container.register('audioIO', () => ({}));

      const names = container.getServiceNames();
      expect(names).toEqual(['logger', 'config', 'audioIO']);
    });

    it('should return empty array when no services', () => {
      expect(container.getServiceNames()).toEqual([]);
    });
  });

  describe('clear()', () => {
    it('should clear specific service', () => {
      container.register('logger', () => ({}));
      container.register('config', () => ({}));

      container.clear('logger');

      expect(container.has('logger')).toBe(false);
      expect(container.has('config')).toBe(true);
    });

    it('should clear all services', () => {
      container.register('logger', () => ({}));
      container.register('config', () => ({}));

      container.clear();

      expect(container.getServiceNames()).toEqual([]);
    });
  });

  describe('getStatus()', () => {
    it('should return container status', () => {
      container.register('logger', () => ({}));
      container.register('config', () => ({}));

      // Create one service
      container.get('logger');

      const status = container.getStatus();

      expect(status.totalServices).toBe(2);
      expect(status.createdServices).toBe(1);
      expect(status.services).toHaveLength(2);
      expect(status.services[0].created).toBe(true);  // logger
      expect(status.services[1].created).toBe(false); // config
    });
  });

  describe('Complex dependency injection', () => {
    it('should handle multi-level dependencies', () => {
      // Level 1: Config (no deps)
      container.register('config', () => ({
        sampleRate: 44100
      }));

      // Level 2: Logger (depends on config)
      container.register('logger', (c) => ({
        config: c.get('config'),
        log: (msg) => `[${c.get('config').sampleRate}] ${msg}`
      }));

      // Level 3: AudioIO (depends on config + logger)
      container.register('audioIO', (c) => ({
        config: c.get('config'),
        logger: c.get('logger'),
        start: () => c.get('logger').log('AudioIO started')
      }));

      // Level 4: App (depends on audioIO + logger)
      container.register('app', (c) => ({
        audioIO: c.get('audioIO'),
        logger: c.get('logger'),
        run: () => c.get('audioIO').start()
      }));

      const app = container.get('app');
      expect(app.run()).toBe('[44100] AudioIO started');
    });

    it('should create dependency tree correctly', () => {
      let createOrder = [];

      container.register('config', () => {
        createOrder.push('config');
        return {};
      });

      container.register('logger', (c) => {
        createOrder.push('logger');
        c.get('config');
        return {};
      });

      container.register('app', (c) => {
        createOrder.push('app');
        c.get('logger');
        return {};
      });

      container.get('app');

      // Dependencies should be created in order
      expect(createOrder).toEqual(['app', 'logger', 'config']);
    });
  });
});
