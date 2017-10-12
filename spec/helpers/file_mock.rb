module Helpers
  module FileMock
    @@files_hash = {}
    @@original_read = File.method(:read)
    @@original_exist = File.method(:exist?)

    def stub_files(files_hash)
      @@files_hash = files_hash

      allow(File).to receive(:read) do |path|
        if @@files_hash[path]
          @@files_hash[path].to_s
        else
          @@original_read.call path
        end
      end

      allow(File).to receive(:write) do |path, content|
        @@files_hash[path] = content
      end

      allow(File).to receive(:exist?) do |path|
        puts "PATH: #{path}"
        @@files_hash.key?(path) || @@original_exist.call(path)
      end
    end
  end
end
