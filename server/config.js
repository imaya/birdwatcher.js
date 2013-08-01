var Config = {
  Port: 3000,
  verbose: false
};

for (var i in Config) {
  exports[i] = Config[i];
}
