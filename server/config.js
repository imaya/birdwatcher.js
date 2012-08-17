var Config = {
  Port: 3000,
};

for (var i in Config) {
  exports[i] = Config[i];
}
