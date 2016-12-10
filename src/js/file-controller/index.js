define(['co', 'md5'], function(co, md5) {
    function FileController(options) {
        var self = this;
        this.fsInitPromise = co(function*() {
            yield self._init();
            self.rootEntry = self.fs.root;

            var savedRootUrl = localStorage.getItem('rootURL');
            if (savedRootUrl) {
                self.rootEntry = yield new Promise(function(resolve, reject) {
                    window.resolveLocalFileSystemURL(savedRootUrl, function(dirEntry) {
                        resolve(dirEntry);
                    }, function(err) {
                        console.error(err);
                        localStorage.setItem('rootURL', self.fs.root.nativeURL);
                        resolve(self.fs.root);
                    });
                });
            }
        }).catch(function(err) {
            console.error(err);
        });
    }


    /** API
     *
     *   getDirectory({@path: String, @root: DirEntry, @create: bool})
     *   getFiles(@dirEntry: DirEntry)
     *
     */

    FileController.prototype.writeFile = function(fileEntry, data) {
        return new Promise(function(resolve, reject) {
            // Create a FileWriter object for our FileEntry (log.txt).
            fileEntry.createWriter(function(fileWriter) {

                fileWriter.onwriteend = function() {
                    // console.log("Successful file write...");
                    return data;
                    // self.readFile(fileEntry).then(resolve, reject);
                };

                fileWriter.onerror = function(e) {
                    console.log("Failed file write: " + e.toString());
                    reject(e);
                };

                fileWriter.write(data);
            });
        });
    };

    FileController.prototype.readFile = function(fileEntry) {
        return new Promise(function(resolve, reject) {
            fileEntry.file(function(file) {
                var reader = new FileReader();

                reader.onloadend = function() {
                    resolve(this.result);
                };

                reader.readAsText(file);

            }, reject);
        });
    };

    FileController.prototype.readFileByName = function(fileName) {
        var self = this;

        return new Promise(function(resolve, reject) {
            var filePaths = fileName.split('/');
            var dirEntry = self.rootEntry;

            if (filePaths.length > 1) {
                var dirPaths = filePaths.slice(0, -1);
                fileName = filePaths.slice(-1)[0];
                // console.log(dirPaths, filePaths.slice(-1));
            }

            co(function*() {
                if (dirPaths) {
                    for (var i = 0; i < dirPaths.length; i++) {
                        if (!dirPaths[i]) {
                            continue;
                        }
                        dirEntry = yield(function() {
                            return new Promise(function(resolve, reject) {
                                dirEntry.getDirectory(dirPaths[i], {
                                    "create": true
                                }, resolve, reject);
                            });
                        })();
                    }
                }

                if (!fileName) {
                    return resolve();
                }

                dirEntry.getFile(fileName, {
                    "create": true
                }, function(fileEntry) {
                    fileEntry.file(function(file) {
                        var reader = new FileReader();

                        reader.onloadend = function() {
                            resolve({
                                fileEntry: fileEntry,
                                fileContent: this.result
                            });
                        };

                        reader.readAsText(file);

                    }, reject);
                }, reject);
            });
        });

    };




    FileController.prototype.getDirectory = function(options) {
        var self = this;
        var rootEntry = options.root || this.rootEntry;
        if (!options.path) {
            throw new Error("path attribute required");
        }

        return new Promise(function(resolve, reject) {
            rootEntry.getDirectory(options.path, {
                "create": options.create || false
            }, resolve, reject);
        });
    };

    FileController.prototype.getFiles = function(dirEntry, navEnabled) {
        dirEntry = dirEntry || this.rootEntry;
        var fileStructure = [];
        var self = this;

        return co(function*() {
            if (navEnabled) {
                if (self.rootEntry == dirEntry) {
                    try {
                        var parentDirectory = yield self.getDirectory({
                            path: '../',
                            create: false
                        });
                        fileStructure.push({
                            'text': '..',
                            'id': '__up',
                            'entry': parentDirectory,
                            'itree': {
                                state: {
                                    selectable: false
                                }
                            },
                            'children': parentDirectory.isDirectory > 0
                        });
                    } catch (err) {
                        console.error('unable to get parentDirectory', err);
                    }
                }
            }
            var directoryReader = dirEntry.createReader();
            yield new Promise(function(resolve, reject) {
                directoryReader.readEntries(function(entries) {
                    for (var i = 0; i < entries.length; i++) {
                        var entry = entries[i];
                        var fileDescription = {
                            'text': entry.name,
                            'id': md5(entry.nativeURL),
                            'entry': entry,
                            'itree': {
                                state: {
                                    selectable: false
                                }
                            },
                            'children': entry.isDirectory > 0
                        };

                        fileStructure.push(fileDescription);
                    }
                    resolve();
                });
            });

            return fileStructure;
        });

    };


    FileController.prototype.wait = FileController.prototype.waitForInit = function() {
        return this.fsInitPromise;
    };


    // Private methods
    FileController.prototype._init = function() {
        var self = this;
        return co(function*() {
            try {
                self.fs = yield self._getFs();
                // console.log('file system open: ' + self.fs.name);
            } catch (err) {
                console.error(err);
                throw err;
            }
        });
    };

    FileController.prototype._getFs = function() {
        return new Promise(function(resolve, reject) {
            window.requestFileSystem(LocalFileSystem.PERSISTENT, 0, resolve, reject);
        });
    };

    return FileController;
});