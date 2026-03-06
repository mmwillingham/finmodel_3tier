(function() {
    var host = window.location.hostname;
    
    // 1. Redirect www to non-www for both domains
    if (host === 'www.modelmyretirement.com' || host === 'www.ordaxium.com') {
      var targetHost = host.replace('www.', '');
      window.location.replace('https://' + targetHost + window.location.pathname + window.location.search);
      return; 
    }

    var isDev = host.includes('ordaxium');
    
    // 2. Inject the correct sitemap for the current domain
    var sitemapFile = isDev ? '/sitemap-ordaxium.xml' : '/sitemap-modelmyretirement.xml';
    var link = document.createElement('link');
    link.rel = 'alternate';
    link.type = 'application/xml';
    link.title = 'Sitemap';
    link.href = sitemapFile;
    document.getElementsByTagName('head')[0].appendChild(link);

    // 3. Tell search engines to ignore the site if it's the dev domain
    if (isDev) {
      var meta = document.createElement('meta');
      meta.name = 'robots';
      meta.content = 'noindex, nofollow';
      document.getElementsByTagName('head')[0].appendChild(meta);
    }
})();
