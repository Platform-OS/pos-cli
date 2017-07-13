module MarketplaceKit
  module Commands
    class Sync
      def execute
        puts "Sync mode enabled"

        listener = Listen.to(MARKETPLACE_BUILDER_FOLDER) do |modified, added, removed|
          changed_file_paths = added + modified

          changed_file_paths.each do |changed_file_path|
            connection = Faraday.new(url: 'http://localhost:3000', headers: { 'Content-Type' => 'application/json' })

            body = File.read(changed_file_path)
            changed_file_path = changed_file_path.gsub("#{Dir.getwd}/#{MARKETPLACE_BUILDER_FOLDER}/", "")
            connection.put("api/marketplace_releases/sync", { "path": changed_file_path, body: body }.to_json)
          end
        end

        listener.start
        sleep
      end
    end
  end
end
