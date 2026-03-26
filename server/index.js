/**
 * 🍬 CandyBox Proxy - SillyTavern Plugin Entry
 * CandyBox Proxy - SillyTavern Plugin Entry
 * 
 * 作者: shleeshlee
 * 仓库: https://github.com/shleeshlee/CandyBox-Proxy
 */

const { ProxyServer } = require('./server');

let proxyServer = null;

/**
 * 重启代理服务器
 */
async function restartProxy() {
  console.log('🍬 CandyBox: 5秒后重启...');

  if (proxyServer) {
    try {
      await proxyServer.stop();
    } catch (err) {
      console.error('🍬 CandyBox: 停止时出错:', err.message);
    }
  }

  setTimeout(async () => {
    console.log('🍬 CandyBox: 正在重启...');
    proxyServer = new ProxyServer();

    proxyServer.on('error', (err) => {
      console.error('🍬 CandyBox: 服务器错误:', err.message);
      restartProxy();
    });

    try {
      await proxyServer.start();
      console.log('🍬 CandyBox: 重启成功');
    } catch (error) {
      console.error('🍬 CandyBox: 重启失败', error);
      restartProxy();
    }
  }, 5000);
}

/**
 * 初始化插件
 */
async function init(router) {
  console.log('🍬 CandyBox Proxy 插件加载中...');

  proxyServer = new ProxyServer();

  proxyServer.on('error', (err) => {
    console.error('🍬 CandyBox: 服务器错误:', err.message);
    restartProxy();
  });

  try {
    await proxyServer.start();
    console.log('🍬 CandyBox: 代理服务器启动成功');
  } catch (error) {
    console.error('🍬 CandyBox: 启动失败', error);
    setTimeout(restartProxy, 5000);
  }

  // 测试端点
  router.get('/test', (req, res) => {
    res.json({
      name: 'CandyBox Proxy',
      status: 'running',
      ports: { http: proxyServer.config.HTTP_PORT, ws: proxyServer.config.WS_PORT },
    });
  });

  return Promise.resolve();
}

/**
 * 清理插件
 */
async function exit() {
  console.log('🍬 CandyBox Proxy 插件卸载中...');

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
    id: 'candybox-proxy',
    name: 'CandyBox Proxy',
    description: 'CandyBox Proxy - Access Gemini API via browser',
  },
};
