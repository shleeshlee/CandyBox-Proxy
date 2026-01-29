/**
 * CottonCandy Proxy - SillyTavern Plugin Entry
 * 棉花糖代理 - 酒馆插件入口
 */

const { ProxyServer } = require('./server');

let proxyServer = null;

/**
 * 重启代理服务器
 */
async function restartProxy() {
  console.log('🍬 CottonCandy: 5秒后重启...');

  if (proxyServer) {
    try {
      await proxyServer.stop();
    } catch (err) {
      console.error('🍬 CottonCandy: 停止时出错:', err.message);
    }
  }

  setTimeout(async () => {
    console.log('🍬 CottonCandy: 正在重启...');
    proxyServer = new ProxyServer();

    proxyServer.on('error', (err) => {
      console.error('🍬 CottonCandy: 服务器错误:', err.message);
      restartProxy();
    });

    try {
      await proxyServer.start();
      console.log('🍬 CottonCandy: 重启成功');
    } catch (error) {
      console.error('🍬 CottonCandy: 重启失败', error);
      restartProxy();
    }
  }, 5000);
}

/**
 * 初始化插件
 */
async function init(router) {
  console.log('🍬 CottonCandy Proxy 插件加载中...');

  proxyServer = new ProxyServer();

  proxyServer.on('error', (err) => {
    console.error('🍬 CottonCandy: 服务器错误:', err.message);
    restartProxy();
  });

  try {
    await proxyServer.start();
    console.log('🍬 CottonCandy: 代理服务器启动成功');
  } catch (error) {
    console.error('🍬 CottonCandy: 启动失败', error);
    setTimeout(restartProxy, 5000);
  }

  // 测试端点
  router.get('/test', (req, res) => {
    res.json({
      name: 'CottonCandy Proxy',
      status: 'running',
      ports: { http: 8811, ws: 9111 },
    });
  });

  return Promise.resolve();
}

/**
 * 清理插件
 */
async function exit() {
  console.log('🍬 CottonCandy Proxy 插件卸载中...');

  if (proxyServer) {
    await proxyServer.stop();
    proxyServer = null;
  }

  return Promise.resolve();
}

module.exports = {
  init,
  exit,
  info: {
    id: 'cottoncandy-proxy',
    name: 'CottonCandy Proxy',
    description: '棉花糖代理 - 通过浏览器身份访问 Gemini API',
  },
};
