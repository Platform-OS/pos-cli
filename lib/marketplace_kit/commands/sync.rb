module MarketplaceKit
  module Commands
    class Sync < BaseCommand
      include Services::Loggable

      def execute
        log :sync_command_started

        listener = Listen.to(MARKETPLACE_BUILDER_FOLDER) do |modified, added, _removed|
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
        log :sync_updating, file_path
        response = gateway.send_file_change relative_file_path(file_path), File.read(file_path)
      end

      def relative_file_path(file_path)
        file_path.gsub("#{Dir.getwd}/#{MARKETPLACE_BUILDER_FOLDER}/", '')
      end
    end
  end
end
