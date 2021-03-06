import { createElement } from 'react';
import dynamic from 'dva/dynamic';
import pathToRegexp from 'path-to-regexp';
import { getMenuData } from './menu';

let routerDataCache;

function getFlatMenuData(menus) {
  let keys = {};

  menus.forEach(item => {
    if (item.children) {
      keys[item.path] = { ...item };
      keys = { ...keys, ...getFlatMenuData(item.children) };
    } else {
      keys[item.path] = { ...item };
    }
  });
  return keys;
}

const modelNotExisted = (app, model) =>
  // eslint-disable-next-line
  !app._models.some(({ namespace }) => {
    return namespace === model.substring(model.lastIndexOf('/') + 1);
  });

const dynamicWrapper = (app, models, component) => {
  // () => require('module')
  // transformed by babel-plugin-dynamic-import-node-sync
  if (component.toString().indexOf('.then(') < 0) {
    models.forEach(model => {
      if (modelNotExisted(app, model)) {
        // eslint-disable-next-line
        app.model(require(`../models/${model}`).default);
      }
    });
    return props => {
      if (!routerDataCache) {
        routerDataCache = getRouterData(app);
      }
      return createElement(component().default, {
        ...props,
        routerData: routerDataCache
      });
    };
  }
  // () => import('module')
  return dynamic({
    app,
    models: () => models.filter(model => modelNotExisted(app, model)).map(m => import(`../models/${m}.js`)),
    // add routerData prop
    component: () => {
      if (!routerDataCache) {
        routerDataCache = getRouterData(app);
      }
      return component().then(raw => {
        const Component = raw.default || raw;

        return props =>
          createElement(Component, {
            ...props,
            routerData: routerDataCache
          });
      });
    }
  });
};

export const getRouterData = app => {
  const routerConfig = {
    '/': {
      component: dynamicWrapper(app, [], () => import('../layouts/BlankLayout'))
    },
    '/home': {
      component: dynamicWrapper(app, ['example'], () => import('../routes/Home'))
    },
    '/resume': {
      component: dynamicWrapper(app, ['example'], () => import('../routes/Resume'))
    },
    '/project': {
      component: dynamicWrapper(app, ['example'], () => import('../routes/Project')),
      name: '个人项目'
    },
    '/blog': {
      component: dynamicWrapper(app, ['article'], () => import('../routes/Blog')),
      name: '博客'
    },
    '/:blog/detail': {
      component: dynamicWrapper(app, ['article'], () => import('../routes/Blog/BlogDetail'))
    },
    '/my-life': {
      component: dynamicWrapper(app, ['example'], () => import('../routes/MyLife')),
      name: '我的生活'
    },
    '/contact': {
      component: dynamicWrapper(app, ['example'], () => import('../routes/Contact')),
      name: '联系方式'
    },
    '/verify': {
      component: dynamicWrapper(app, [], () => import('../routes/Verify')),
      name: '跳转中...'
    }
  };
  // Get name from ./menu.js or just set it in the router data.
  const menuData = getFlatMenuData(getMenuData());

  // Route configuration data
  // eg. {name,authority ...routerConfig }
  const routerData = {};
  // The route matches the menu

  Object.keys(routerConfig).forEach(path => {
    // Regular match item name
    // eg.  router /user/:id === /user/chen
    const pathRegexp = pathToRegexp(path);
    const menuKey = Object.keys(menuData).find(key => pathRegexp.test(`${key}`));
    let menuItem = {};
    // If menuKey is not empty

    if (menuKey) {
      menuItem = menuData[menuKey];
    }
    let router = routerConfig[path];
    // If you need to configure complex parameter routing,
    // https://github.com/ant-design/ant-design-pro-site/blob/master/docs/router-and-nav.md#%E5%B8%A6%E5%8F%82%E6%95%B0%E7%9A%84%E8%B7%AF%E7%94%B1%E8%8F%9C%E5%8D%95
    // eg . /list/:type/user/info/:id

    router = {
      ...router,
      name: router.name || menuItem.name,
      authority: router.authority || menuItem.authority,
      hideInBreadcrumb: router.hideInBreadcrumb || menuItem.hideInBreadcrumb
    };
    routerData[path] = router;
  });
  return routerData;
};
