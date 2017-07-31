module MarketplaceKit
  module Commands
    class Sync < BaseCommand
      def execute
        puts 'Sync mode enabled'.green

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
        puts "Updating: #{file_path}".green
        response = gateway.send_file_change relative_file_path(file_path), File.read(file_path)
        puts 'Done!'.green if response.success?
      end

      def relative_file_path(file_path)
        file_path.gsub("#{Dir.getwd}/#{MARKETPLACE_BUILDER_FOLDER}/", '')
      end
    end
  end
end
