BirdWatcher
=========
BirdWatcher は JavaScript で書かれた JavaScript プロファイリングライブラリです。

Using this tool
---------------

BirdWatcher では、そのページだけで完結する console での使い方と、
リモートサーバにプロファイリング結果を送信する使い方の２種類の使用方法をサポートしています。

### Console

コンソールにプロファイル結果を出力します。

    <script src="./birdwatcher.js">
    <script>
        var birdwatcher = new BirdWatcher([
          ['NameSpace'], // NameSpace 以下の function すべて
          ['Foo', 'bar'] // Foo.bar 以下の function すべて
        ]);

        // start profiling
        birdwatcher.start();

        // report to console
        setTimeout(function() {
          birdwatcher.report();
        }, 10000);
    </script>

### Remote

BirdWatcher サーバにプロファイル結果を送信します。

#### Server (require node.js 0.8+, socket.io)

    $ cd server
    $ node server.js

#### Client

    <script src="./birdwatcher.js">
    <script>
        var birdwatcher = new BirdWatcher([
          ['NameSpace'], // NameSpace 以下の function すべて
          ['Foo', 'bar'] // Foo.bar 以下の function すべて
        ]);

        // remote server settings
        birdwatcher.reportId = 'hoge'; // レポート識別子
        birdwatcher.reportUrl = 'http://(birdwatcher server):3000/';

        // start profiling
        birdwatcher.start();

        // report to remote server
        setInterval(function() {
          birdwatcher.reportRemote();
        }, 1000);
    </script>

#### Monitor

上記の例では、以下の URL にアクセスするとリモートサーバで受信しているログの一覧が表示されます。

    http://(birdwatcher server):3000/

ログのレポートIDを指定して、プロファイルを見る事が出来ます。上記の例では、以下のような URL になります。

    http://(birdwatcher server):3000/#hoge

また、デフォルトでは上位 30 位までの表示ですが、この値を変更したいにはパスを以下のように変更します。

    http://(birdwatcher server):3000/50#hoge

この例では 50 件の表示になります。

#### Remote Log

BirdWatcher はリモートプロファイラですが、console.log, console.warn, console.error をリモートに飛ばすことも出来ます。
リモートログ機能を有効にするには、以下のように enableRemoteLog メソッドを呼ぶだけです。

    birdwatcher.enableRemoteLog();

これでプロファイルと同様にログも見る事ができるようになります。

#### Navigation Timing

リモートログの他に、Navigation Timing API のデータを飛ばす事も出来ます。

    birdwatcher.reportPerformanceTiming();

`BirdWatcher#reportPerformanceTiming()` メソッドでは performance.timing が存在する時だけ有効で、サポートしていない環境では無視します。


#### その他

##### reportId がかぶってログが見にくい

一つの受信サーバで同じページのプロファイリングを複数行いたい場合は、
たとえば以下のように <code>reportId</code> に現在日時をいれるなどして区別すると良いかもしれません。

    birdwatcher.reportId = 'hoge-' + (Date.now ? Date.now() : +new Date()); // レポート識別子

##### ログの送信方法を変更したい

BirdWatcher では img 要素を生成して body に追加することでサーバに GET リクエストを送っています。
要素の生成と追加を行いたくない場合は XMLHttpRequest で送る事も可能です。

    birdwatcher.sendMethod = 'xhr'; // 'img' or 'xhr'

これで XMLHttpRequest を使った GET リクエストでサーバにデータが送信されます。


プロファイルの仕組み
------

 - JavaScript でプロファイル対象の function を置き換えているので、function call が一段ふえます。
 - プロファイル対象の function 同士でネストしている呼び出しにおいてはプロファイル用の function を毎回通るため、
    プロファイリングを無効にしているときの速度と結果が乖離することがあります。

