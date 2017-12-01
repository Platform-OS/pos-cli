module MarketplaceKit
  module Services
    class Logger
      def deploy_started
        puts 'Deploy command started'.green
      end

      def compressing_folder
        puts 'Compressing marketplace_builder folder'.yellow
      end

      def sending_zip
        puts 'Sending zip file to the server'.yellow
      end

      def wait_for_deploy_finish
        puts 'Waiting for deploy to finish'.yellow
      end

      def deploy_succeeded
        puts 'Deploy command succeded'.green
      end

      def pull_started
        puts 'Pull command started'.green
      end

      def request_backup
        puts 'Requesting system backup...'.yellow
      end

      def wait_for_backup_finish
        puts 'Waiting for backup to finish'.yellow
      end

      def pull_succeeded
        puts 'Pull command succeded'.green
      end

      def sync_command_started
        puts 'Sync mode enabled'.green
      end

      def sync_updating(file_path)
        puts "Updating: #{file_path}".green
      end

      def ask_for_email
        puts 'Enter your email:'.yellow
      end

      def ask_for_password
        puts 'Enter your password:'.yellow
      end

      def redirect_tip
        puts 'Server returned redirect code (possible a wrong domain in config file?)'.yellow
      end

      def version(version)
        puts "marketplace-kit #{version}"
      end

      def usage
        puts 'Usage: marketplace-kit sync | deploy | pull'
        puts '  -e endpoint     endpoint from your config file'
        puts '  -v              show current version'
      end

      def json_error(source)
        puts '```'.red
        puts 'Error while parsing JSON'.red
        puts "Raw body:\n#{source}"
        puts '```'.red
      end

      def api_error(message, details)
        puts '```'.red
        puts "Builder error: #{message}".red
        puts 'Details:'
        puts details
        puts '```'.red
      end

      def standard_error(error)
        puts '```'.red
        puts "Error: #{error.message} (#{error.class})".red
        puts '```'.red
      end
    end
  end
end
