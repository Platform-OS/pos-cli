module MarketplaceKit
  module Commands
    class Sync
      def execute
        puts "Sync mode enabled"

        listener = Listen.to(MARKETPLACE_BUILDER_FOLDER) do |modified, added, removed|
          changed_file_paths = added + modified

          changed_file_paths.each do |changed_file_path|
            on_file_change(changed_file_path)
          end
        end

        listener.start
        sleep
      end

      private

      def on_file_change(file_path)
        body = File.read(file_path)
        relative_file_path = file_path.gsub("#{Dir.getwd}/#{MARKETPLACE_BUILDER_FOLDER}/", "")

        gateway.send_file_change relative_file_path, body
      end

      def gateway
        @gateway ||= Services::ApiGateway.new
      end
    end
  end
end
